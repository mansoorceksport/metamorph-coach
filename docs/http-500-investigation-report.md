# HTTP 500 Error Investigation Report

**Date:** 2026-01-22  
**Investigator:** AI Assistant  
**Systems Analyzed:** metamorph (backend) & metamorph-coach (frontend)

---

## Executive Summary

The HTTP 500 errors occurring on `POST /v1/pro/exercises/{id}/sets` and `POST /v1/pro/schedules/{id}/exercises` are caused by a **race condition** in the frontend sync queue. When a coach creates a schedule, adds exercises, and the sets are synced before the parent exercise has completed its sync, the backend receives a ULID (frontend-generated ID) that it cannot resolve to a MongoDB ObjectID—resulting in a 500 error.

---

## 1. Backend Deletion Behavior Analysis

### Schedules (`mongo_schedule.go`)

| Method | Type | Behavior |
|--------|------|----------|
| `Delete()` | **Permanent** | Uses `DeleteOne()` - removes document from MongoDB |
| `SoftDelete()` | **Soft** | Sets `deleted_at` timestamp, preserves document |

**Current Usage:** The API endpoint `DELETE /v1/pro/schedules/:id` calls `PTService.DeleteSchedule()` which uses **`SoftDelete()`** (line 320 in `pt_service.go`).

```go
func (s *PTService) DeleteSchedule(ctx context.Context, id string) error {
    // Soft delete: preserve data but mark as deleted
    return s.schedRepo.SoftDelete(ctx, id)
}
```

> ✅ **Schedules are SOFT-DELETED** - data is preserved with `deleted_at` timestamp

---

### Set Logs (`mongo_set_log.go`)

| Method | Type | Behavior |
|--------|------|----------|
| `Delete()` | **Permanent** | Single document removal |
| `DeleteByPlannedExerciseID()` | **Permanent** | Cascade delete all sets for an exercise |
| `DeleteByScheduleID()` | **Permanent** | Cascade delete all sets for a schedule |
| `SoftDelete()` | **Soft** | Sets `deleted_at` timestamp |

**Current Usage:** 
- `DELETE /v1/pro/sets/:id` calls `WorkoutService.DeleteSetLog()` which uses **`SoftDelete()`** (line 407 in `workout_service.go`)
- Cascade deletes (when removing exercises) use **`DeleteByPlannedExerciseID()`** (permanent)

```go
func (s *WorkoutService) DeleteSetLog(ctx context.Context, idOrClientID string) error {
    // Soft delete: preserve data but mark as deleted
    return s.setLogRepo.SoftDelete(ctx, setLog.ID)
}
```

> ⚠️ **Set logs use MIXED deletion:**
> - Individual deletes via API = soft-delete
> - Cascade deletes when removing exercises = permanent delete

---

### Exercises (`mongo_exercise.go` - Master Library)

| Method | Type | Behavior |
|--------|------|----------|
| `Delete()` | **Permanent** | Removes exercise from master library |

> ℹ️ This is the master exercise library (Bench Press, Squat, etc.) - rarely deleted

---

### Planned Exercises (`mongo_workout_session.go`)

| Method | Type | Behavior |
|--------|------|----------|
| `RemovePlannedExercise()` | **Permanent** | Deletes single planned exercise from session |
| `DeletePlannedExercisesBySchedule()` | **Permanent** | Cascade deletes all exercises for a schedule |

> ⚠️ **Planned exercises are PERMANENTLY deleted**

---

## 2. Frontend CRUD Pattern Analysis (metamorph-coach)

### Local-First Architecture

The coach dashboard uses a **local-first** architecture with Dexie (IndexedDB) for offline support:

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│  UI Component   │────▶│   IndexedDB  │────▶│  Sync Queue │
│  (Vue/Nuxt)     │     │   (Dexie)    │     │             │
└─────────────────┘     └──────────────┘     └──────┬──────┘
                                                     │
                                                     ▼
                                              ┌─────────────┐
                                              │   Backend   │
                                              │  (API)      │
                                              └─────────────┘
```

### Dual-Identity System

The frontend uses a **dual-identity** pattern:
- **Local ID (`id`)**: ULID generated client-side immediately
- **Remote ID (`remote_id`)**: MongoDB ObjectID received after sync

### Key Functions in `useDatabase.ts`

| Function | Purpose |
|----------|---------|
| `addPlannedExerciseWithSync()` | Creates exercise locally, queues POST to backend |
| `addSetWithSync()` | Creates set locally, queues POST to backend |
| `removePlannedExerciseWithSync()` | Smart deletion with cascade cancellation |
| `cancelPendingOperationsForExercise()` | Cancels orphaned set syncs when exercise deleted |

---

## 3. Root Cause of HTTP 500 Errors

### The Problem Flow

```
1. Coach creates schedule (sync queued)
2. Coach adds Exercise A (sync queued with client_id ULID)
3. Coach adds Set 1 to Exercise A (sync queued immediately)
4. Set 1 sync attempts BEFORE Exercise A sync completes
   └── Backend receives: POST /v1/pro/exercises/01KFDSCKRNQTQRV4GFB0P5F3WT/sets
   └── Backend tries to resolve "01KFDSCKRNQTQRV4GFB0P5F3WT" (ULID)
   └── resolvePlannedExercise() fails → "exercise not found"
   └── 500 Internal Server Error
```

### Backend Resolution Logic

The backend's `resolvePlannedExercise()` in `workout_service.go` (lines 468-492):

```go
func (s *WorkoutService) resolvePlannedExercise(ctx context.Context, idOrClientID string) (*domain.PlannedExercise, error) {
    // Check if it's a MongoDB ObjectID (24 hex chars)
    isMongoID := len(idOrClientID) == 24
    // ... validation ...
    
    if isMongoID {
        exercise, err := s.sessionRepo.GetPlannedExerciseByID(ctx, idOrClientID)
        if err == nil {
            return exercise, nil
        }
        // Fall through to try client_id
    }
    
    // Try to get by client_id (ULID)
    return s.sessionRepo.GetPlannedExerciseByClientID(ctx, idOrClientID)
}
```

**The issue:** When Exercise A hasn't synced yet:
- The exercise document doesn't exist in MongoDB
- `GetPlannedExerciseByClientID()` returns "not found"
- Handler returns 500 error

### Frontend Code Path

In `addSetWithSync()` (lines 693-746):

```typescript
async function addSetWithSync(plannedExerciseId: string, setIndex: number): Promise<SetLog> {
    const plannedExercise = await db.plannedExercises.get(plannedExerciseId)
    
    // Queue sync to backend
    const backendExId = plannedExercise.remote_id || plannedExerciseId  // <-- PROBLEM!
    
    await queueSync({
        method: 'POST',
        url: `${baseUrl}/v1/pro/exercises/${backendExId}/sets`,  // Uses ULID if not synced
        // ...
    })
}
```

**The bug:** `backendExId` falls back to the ULID (`plannedExerciseId`) when `remote_id` is null (before sync completes).

---

## 4. Why This Happens

### Sync Queue Has No Dependency Ordering

The sync queue processes items in order of creation time with priority, but **does not enforce parent-child relationships**:

```typescript
await queueSync({
    method: 'POST',
    url: `${baseUrl}/v1/pro/schedules/${backendScheduleId}/exercises`,
    context: {
        type: 'exercise_add',
        temp_id: id,
        schedule_id: exercise.schedule_id
    }
})
```

Sets queued immediately after don't wait for the exercise sync to complete:

```typescript
await queueSync({
    method: 'POST', 
    url: `${baseUrl}/v1/pro/exercises/${backendExId}/sets`,  // Uses ULID!
    context: {
        type: 'set_add',
        temp_id: newSetLog.id,
        planned_exercise_id: plannedExerciseId  // Local ULID
    }
})
```

---

## 5. Recommended Fixes

### Option A: Backend Support for Deferred Resolution (Preferred)

Make the backend accept ULID for sets even if the exercise isn't synced yet. Store the set with a reference to the ULID and resolve when the exercise arrives.

**Pros:** No frontend changes, graceful handling  
**Cons:** More backend complexity

### Option B: Frontend Dependency-Aware Sync Queue

Update the sync queue to detect when a set sync should wait for its parent exercise sync:

```typescript
// In addSetWithSync()
if (!plannedExercise.remote_id) {
    // Don't queue yet - wait for exercise to sync first
    // Or: Mark this as dependent on exercise_add for this temp_id
}
```

**Pros:** Prevents race condition at source  
**Cons:** More complex sync logic, potential queue blocking

### Option C: Retry with Backoff (Quick Fix)

Add retry logic when 500 occurs on set creation:

```typescript
// In sync processor
if (response.status === 500 && context.type === 'set_add') {
    // Check if parent exercise has remote_id now
    const exercise = await db.plannedExercises.get(context.planned_exercise_id)
    if (exercise?.remote_id) {
        // Retry with updated URL
        item.url = item.url.replace(context.planned_exercise_id, exercise.remote_id)
    }
}
```

**Pros:** Simple to implement  
**Cons:** Still causes 500 errors before retry

---

## 6. Summary Table

| Entity | Delete Type | Notes |
|--------|-------------|-------|
| Schedule | **Soft** | Uses `deleted_at`, filtered in queries |
| Set Log (via API) | **Soft** | Uses `deleted_at` |
| Set Log (cascade) | **Permanent** | Via `DeleteByPlannedExerciseID()` |
| Planned Exercise | **Permanent** | No soft-delete implemented |
| Master Exercise | **Permanent** | Rarely deleted (library items) |

---

## 7. Action Items

1. **Immediate:** Add logging to backend `resolvePlannedExercise()` to capture failed ULID lookups
2. **Short-term:** Implement Option C (retry with backoff) as a quick fix
3. **Medium-term:** Implement Option B (dependency-aware sync queue) for proper fix
4. **Consider:** Adding soft-delete for planned exercises for consistency

---

*Report generated from analysis of:*
- `metamorph/internal/repository/mongo_schedule.go`
- `metamorph/internal/repository/mongo_set_log.go`
- `metamorph/internal/repository/mongo_workout_session.go`
- `metamorph/internal/service/workout_service.go`
- `metamorph/internal/service/pt_service.go`
- `metamorph-coach/app/composables/useDatabase.ts`
