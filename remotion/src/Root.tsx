import {Composition} from 'remotion';
import {Hello} from './Hello';
import {WhyReviewsReels} from './reviews/Reels';
import {AiTeam, DURATION} from './aiteam/AiTeam';
import {AiTeam01, DURATION_01} from './aiteam01/AiTeam01';
import {FbReel, DURATION_FB, FPS as FB_FPS} from './fbreel/FbReel';
import {AdRecreate, DURATION_AD} from './adrecreate/AdRecreate';
import {BossPromo, DURATION_PROMO} from './promo/Promo';
import {Walkthrough, DURATION_WT} from './walkthrough/Walkthrough';

export const Root = () => {
  return (
    <>
      {/* Reels / Stories 9:16, 50 seconds, same script, voice and music as the BOSS version */}
      <Composition id="WhyReviewsReels" component={WhyReviewsReels} durationInFrames={1500} fps={30} width={1080} height={1920} />
      {/* First AI team Reel, 9:16, about 2 minutes, voiceover by Krista Mashore (ElevenLabs) */}
      <Composition id="AiTeam" component={AiTeam} durationInFrames={DURATION} fps={30} width={1080} height={1920} />
      {/* same Reel remade in BOSS Motion Graphics - 01 */}
      <Composition id="AiTeam01" component={AiTeam01} durationInFrames={DURATION_01} fps={30} width={1080} height={1920} />
      {/* 46s SaaS ad structure recreated with placeholder brand/content, 16:9 */}
      <Composition id="AdRecreate" component={AdRecreate} durationInFrames={DURATION_AD} fps={30} width={1920} height={1080} />
      {/* AI employees explainer, recreated from a reference reel look, 16:9, Krista voiceover */}
      <Composition id="FbReel" component={FbReel} durationInFrames={DURATION_FB} fps={FB_FPS} width={1920} height={1080} />
      {/* BOSS Studio product explainer, 16:9, Krista voiceover: pitch, app tour, close */}
      <Composition id="BossPromo" component={BossPromo} durationInFrames={DURATION_PROMO} fps={30} width={1920} height={1080} />
      {/* BOSS dashboard walkthrough, 16:9, Krista voiceover, Studio Tour style */}
      <Composition id="Walkthrough" component={Walkthrough} durationInFrames={DURATION_WT} fps={30} width={1920} height={1080} />
      <Composition
        id="Hello"
        component={Hello}
        durationInFrames={90}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{title: 'remotion is ready'}}
      />
    </>
  );
};
