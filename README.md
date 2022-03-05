# rollup-plugin-polly

Compile-time parser generator for Rollup and Vite.

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
  Answer: '42' <end>
`;

myParser("42"); // true
myParser("55"); // false
```

## Parser specification grammar

```text
Grammar: W Definition+ <end>
Definition: Name Colon Expression

Expression: Sequence (Pipe Sequence)*
Sequence: Prefix*
Prefix: (And | Not)? Suffix
Suffix: Primary (Question | Star | Plus)?
Primary: Name !Colon
       | Open Expression Close
       | String
       | CharClass
       | Special

# Lexemes
Name: NameStart NameCont* NamePrime* W
NameStart: [A-Za-z_]
NameCont: NameStart
        | [0-9]
NamePrime: "'"

String: "'" (!"'" <any>)* "'" W
      | '"' (!'"' Char)* '"' W

CharClass: '[' (!']' Range)* ']' W
Range: Char ('-' Char)?

Char: '\' [nrt'"\[\]\\]
    | '\u{' Hex Hex? Hex? Hex? Hex? Hex? Hex? '}'
    | !'\' <any>
Hex: [0-9A-Fa-f]

Special: '<end>'
       | '<any>'

Colon: ':' W
Pipe: '|' W
And: '&' W
Not: '!' W
Question: '?' W
Star: '*' W
Plus: '+' W
Open: '(' W
Close: ')' W

W: Space
 | Comment

Space: ' ' | "\t" | "\r" | NL
NL: "\n"

Comment: '#' (!NL <any>)* NL
```

## Licence

[MIT.](LICENSE.txt)
