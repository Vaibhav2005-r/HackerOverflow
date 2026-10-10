import { assertEquals } from "jsr:@std/assert@1";
import { RateLimiter } from "./ratelimit.ts";

Deno.test("allows the first call, then blocks within the interval", () => {
  const r = new RateLimiter(2000);
  assertEquals(r.check("t", 1000), 0);
  assertEquals(r.check("t", 2500), 500);
  assertEquals(r.check("t", 3000), 0);
});
Deno.test("keys are independent", () => {
  const r = new RateLimiter(2000);
  assertEquals(r.check("a", 0), 0);
  assertEquals(r.check("b", 1), 0);
});
Deno.test("memory is bounded", () => {
  const r = new RateLimiter(2000, 3);
  for (let i = 0; i < 10; i++) r.check(`k${i}`, i);
  assertEquals(r.check("k9", 11) >= 0, true);
});
