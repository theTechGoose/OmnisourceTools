import { format } from "npm:date-fns";

while (true) {
  await new Promise((r) => setTimeout(r, 1000));
  console.log(
    JSON.stringify({
      time: format(new Date(), "H:mm:ss.SSS"),
      lvl: "info",
      msg: "This is a log message from the fixture.",
      id: Deno.pid,
      svc: "fixture-service",
    }),
  );
}
