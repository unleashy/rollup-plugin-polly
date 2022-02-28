import theDefault, { createParser as anotherName } from "rollup-plugin-polly";

export const parser = anotherName`complex!`;

function createParser() {
  return "fake parser";
}

export const fakeParser = createParser``;

const __useToShutRollupUp = theDefault;
