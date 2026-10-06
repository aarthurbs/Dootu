import "./index.css";
import {Composition} from "remotion";
import {ValorantEdit} from "./Composition";
import {config, totalFrames} from "./config";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="ValorantChamber" component={ValorantEdit} durationInFrames={totalFrames} fps={config.fps} width={config.width} height={config.height} defaultProps={{debugScreen: false, gameplayEnabled: true, musicEnabled: true}} />
    </>
  );
};
