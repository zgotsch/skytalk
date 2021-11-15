import {SkynetClient} from "skynet-js";

const skynetClient = new SkynetClient("https://siasky.net");

export const dataDomain = window.location.hostname;

export default skynetClient;
