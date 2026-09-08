import { Composition } from "remotion";
import { Clip, FPS, HEIGHT, WIDTH, defaultProps } from "./Clip.jsx";

// A duração NÃO é fixa: cada corte tem a sua. Ela chega em `durationSec` no --props que o
// serve.py monta, e o calculateMetadata a converte em frames. Sem isso a composição teria
// que ser reescrita a cada corte.
export const RemotionRoot = () => {
  return (
    <Composition
      id="Clip"
      component={Clip}
      durationInFrames={30 * FPS}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => ({
        durationInFrames: Math.max(1, Math.round((props.durationSec || 30) * FPS)),
      })}
    />
  );
};
