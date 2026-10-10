import mobileAds,{AdsConsent} from 'react-native-google-mobile-ads';
export async function prepareAds(){await AdsConsent.requestInfoUpdate();const result=await AdsConsent.loadAndShowConsentFormIfRequired();if(!result.canRequestAds)return false;await mobileAds().initialize();return true;}
export async function privacyOptions(){await AdsConsent.showPrivacyOptionsForm();}
