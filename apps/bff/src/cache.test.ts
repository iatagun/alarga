import assert from "node:assert/strict";
import { test } from "node:test";
import { getOrLoad } from "./cache.ts";

test("taze kayıt varsa load çağrılmaz", async () => {
  let calls = 0;
  const load = async () => {
    calls++;
    return calls;
  };
  const a = await getOrLoad("k1", 60_000, load);
  const b = await getOrLoad("k1", 60_000, load);
  assert.equal(a.value, 1);
  assert.equal(b.value, 1);
  assert.equal(b.stale, false);
  assert.equal(calls, 1);
});

test("TTL geçince yeniden yükler", async () => {
  let calls = 0;
  const load = async () => ++calls;
  await getOrLoad("k2", 0, load);
  await new Promise((r) => setTimeout(r, 2));
  const b = await getOrLoad("k2", 0, load);
  assert.equal(b.value, 2);
});

test("load çökerse bayat kayıt döner", async () => {
  await getOrLoad("k3", 0, async () => "iyi");
  await new Promise((r) => setTimeout(r, 2));
  const res = await getOrLoad("k3", 0, async () => {
    throw new Error("çöktü");
  });
  assert.equal(res.value, "iyi");
  assert.equal(res.stale, true);
});

test("load çökerse ve kayıt yoksa hata fırlatır", async () => {
  await assert.rejects(
    getOrLoad("k4", 0, async () => {
      throw new Error("çöktü");
    }),
  );
});
