import {bundle} from '@remotion/bundler';
import {openBrowser, selectComposition, renderStill} from '@remotion/renderer';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';

await mkdir('out/stills', {recursive: true});
const serveUrl = await bundle({entryPoint: path.resolve('src/index.ts'), rspack: true});
const browser = await openBrowser('chrome');
try {
  const inputProps = {debugScreen: false, gameplayEnabled: true, musicEnabled: true};
  const composition = await selectComposition({serveUrl, id: 'ValorantChamber', inputProps, puppeteerInstance: browser});
  const samples = [
    ['00-setup', 30], ['01-approach', 210], ['02-replace-start', 300],
    ['03-replace-middle', 330], ['04-replace-end', 360], ['05-chamber', 405],
    ['06-gameplay', 486], ['07-last-kill', 1090], ['08-ending', 1210], ['09-black', 1259],
  ];
  for (const [name, frame] of samples) {
    await renderStill({serveUrl, composition, inputProps, frame, output: `out/stills/${name}.png`, imageFormat: 'png', puppeteerInstance: browser});
    console.log(`${name}: frame ${frame}`);
  }
  for (const [name, frame, props] of [
    ['debug-screen', 315, {...inputProps, debugScreen: true}],
    ['fallback-no-gameplay', 900, {...inputProps, gameplayEnabled: false}],
  ]) {
    await renderStill({serveUrl, composition, inputProps: props, frame, output: `out/stills/${name}.png`, imageFormat: 'png', puppeteerInstance: browser});
    console.log(name);
  }
} finally {
  await browser.close({silent: true});
}
