# rollup-plugin-polly

Compile-time parser generator for Rollup.

## Usage

Add as a plugin to your rollup config:

```js
export polly from "rollup-plugin-polly";

export default {
  // ...
  plugins: [polly()]
}
```

Then use it as such:

```js
import { createParser } from "rollup-plugin-polly";

const myParser = createParser`
  Answer: '42'
`;

myParser("42");
```

TODO docs

## Licence

[MIT.](LICENSE.txt)
