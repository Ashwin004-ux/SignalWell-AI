import test from "node:test";
import assert from "node:assert/strict";
import { accountDay, boundedIntervalStart, isLateNight, splitInterval, trackingAllowed } from "./tracker-core.mjs";

test("tracking requires opt-in, focus, active state, and an account", () => {
  assert.equal(trackingAllowed({ optedIn: false, focused: true, idleState: "active", accountId: "u1" }), false);
  assert.equal(trackingAllowed({ optedIn: true, focused: false, idleState: "active", accountId: "u1" }), false);
  assert.equal(trackingAllowed({ optedIn: true, focused: true, idleState: "locked", accountId: "u1" }), false);
  assert.equal(trackingAllowed({ optedIn: true, focused: true, idleState: "active", accountId: "u1" }), true);
  assert.equal(trackingAllowed({ optedIn: true, focused: true, idleState: "active", accountId: "" }), false);
});

test("late-night interval uses configured local-time boundaries", () => {
  const at = (hour, minute) => new Date(2026, 5, 10, hour, minute).getTime();
  assert.equal(isLateNight(at(21, 59), 22, 5), false);
  assert.equal(isLateNight(at(22, 0), 22, 5), true);
  assert.equal(isLateNight(at(4, 59), 22, 5), true);
  assert.equal(isLateNight(at(5, 0), 22, 5), false);
});

test("time interval is split at midnight and late-night seconds stay a subset", () => {
  const start = new Date(2026, 5, 10, 23, 59, 59).getTime();
  const result = splitInterval(start, 3, 22, 5);
  assert.deepEqual(result.map(({ date, seconds, lateNightSeconds }) => ({ date, seconds, lateNightSeconds })), [
    { date: "2026-06-10", seconds: 1, lateNightSeconds: 1 },
    { date: "2026-06-11", seconds: 2, lateNightSeconds: 2 }
  ]);
  assert.ok(result.every((row) => row.lateNightSeconds <= row.seconds));
});

test("midnight interval ending at 5 AM excludes the after-boundary seconds", () => {
  const start = new Date(2026, 5, 10, 4, 59, 59).getTime();
  const [row] = splitInterval(start, 3, 22, 5);
  assert.equal(row.lateNightSeconds, 1);
});

test("account day storage isolates accounts and preserves each account's state", () => {
  const activity = {};
  const first = accountDay(activity, "2026-06-10", "account-a");
  first.totalSeconds = 60;
  assert.equal(accountDay(activity, "2026-06-10", "account-a"), first);
  const second = accountDay(activity, "2026-06-10", "account-b");
  assert.notEqual(second, first);
  assert.equal(second.ownerId, "account-b");
});

test("long gaps are capped and restarted workers use their fresh timestamp", () => {
  const restartedAt = 1000000;
  assert.equal(boundedIntervalStart(restartedAt, restartedAt + 600000, 30), restartedAt + 570000);
  assert.equal(boundedIntervalStart(restartedAt + 600000, restartedAt + 600000, 30), restartedAt + 600000);
});
