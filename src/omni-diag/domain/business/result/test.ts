import { assertEquals, assertThrows } from "@std/assert";
import { Result, ResultPattern } from "./mod.ts";

Deno.test("ResultPattern - ok creates success result", () => {
  const result = ResultPattern.ok<number>(42);
  assertEquals(result.ok, true);
  assertEquals((result as any).value, 42);
});

Deno.test("ResultPattern - err creates error result", () => {
  const error = new Error("Something went wrong");
  const result = ResultPattern.err<number>(error);
  assertEquals(result.ok, false);
  assertEquals((result as any).error, error);
});

Deno.test("ResultPattern - isOk identifies success results", () => {
  const okResult = ResultPattern.ok(42);
  const errResult = ResultPattern.err(new Error("Fail"));

  assertEquals(ResultPattern.isOk(okResult), true);
  assertEquals(ResultPattern.isOk(errResult), false);
});

Deno.test("ResultPattern - isErr identifies error results", () => {
  const okResult = ResultPattern.ok(42);
  const errResult = ResultPattern.err(new Error("Fail"));

  assertEquals(ResultPattern.isErr(okResult), false);
  assertEquals(ResultPattern.isErr(errResult), true);
});

Deno.test("ResultPattern - map transforms success values", () => {
  const result = ResultPattern.ok(10);
  const mapped = ResultPattern.map(result, (x) => x * 2);

  assertEquals(ResultPattern.isOk(mapped), true);
  assertEquals(ResultPattern.unwrap(mapped), 20);
});

Deno.test("ResultPattern - map ignores error results", () => {
  const error = new Error("Original");
  const result = ResultPattern.err<number>(error);
  const mapped = ResultPattern.map(result, (x) => x * 2);

  assertEquals(ResultPattern.isErr(mapped), true);
  assertEquals((mapped as any).error, error);
});

Deno.test("ResultPattern - mapErr transforms error values", () => {
  const result = ResultPattern.err<number>(new Error("Original"));
  const mapped = ResultPattern.mapErr(result, (e) => new Error(`Wrapped: ${e.message}`));

  assertEquals(ResultPattern.isErr(mapped), true);
  assertEquals((mapped as any).error.message, "Wrapped: Original");
});

Deno.test("ResultPattern - unwrap returns value for success", () => {
  const result = ResultPattern.ok(42);
  assertEquals(ResultPattern.unwrap(result), 42);
});

Deno.test("ResultPattern - unwrap throws for error", () => {
  const error = new Error("Test error");
  const result = ResultPattern.err<number>(error);

  assertThrows(
    () => ResultPattern.unwrap(result),
    Error,
    "Test error"
  );
});

Deno.test("ResultPattern - unwrapOr provides default for error", () => {
  const okResult = ResultPattern.ok(42);
  const errResult = ResultPattern.err<number>(new Error("Fail"));

  assertEquals(ResultPattern.unwrapOr(okResult, 0), 42);
  assertEquals(ResultPattern.unwrapOr(errResult, 0), 0);
});

Deno.test("ResultPattern - fromPromise handles resolved promises", async () => {
  const promise = Promise.resolve(42);
  const result = await ResultPattern.fromPromise(promise);

  assertEquals(ResultPattern.isOk(result), true);
  assertEquals(ResultPattern.unwrap(result), 42);
});

Deno.test("ResultPattern - fromPromise handles rejected promises", async () => {
  const error = new Error("Async fail");
  const promise = Promise.reject(error);
  const result = await ResultPattern.fromPromise(promise);

  assertEquals(ResultPattern.isErr(result), true);
  assertEquals((result as any).error, error);
});

Deno.test("ResultPattern - fromPromise with error mapper", async () => {
  const promise = Promise.reject("string error");
  const result = await ResultPattern.fromPromise(
    promise,
    (e) => new Error(String(e))
  );

  assertEquals(ResultPattern.isErr(result), true);
  assertEquals((result as any).error.message, "string error");
});