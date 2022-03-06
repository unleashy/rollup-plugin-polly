import { createParser } from "rollup-plugin-polly";
import './style.css'

document.querySelector('#app').innerHTML = `
  <h1>Hello Vite!</h1>
  <a href="https://vitejs.dev/guide/features.html" target="_blank">Documentation</a>
`

window.pollyParser = createParser`
  Root: XY+
  XY: "x" | "y"
`;
