import { createParser } from "rollup-plugin-polly";

// Recognises the context-sensitive language a^n b^n c^n for all n >= 1
export const parser = createParser`
  Root: &(A !'b') 'a'+ B <end>
  A: 'a' A? 'b'
  B: 'b' B? 'c'
`;
