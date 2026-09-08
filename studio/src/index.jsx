// Ponto de entrada do Remotion. Nada aqui vai para o navegador do site: o index.html
// continua Vanilla JS puro, sem npm (CLAUDE.md). Este bundle só existe dentro do studio/.
import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root.jsx";

registerRoot(RemotionRoot);
