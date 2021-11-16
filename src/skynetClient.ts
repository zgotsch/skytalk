import {SkynetClient} from "skynet-js";

const skynetClient = new SkynetClient("https://siasky.net");

export const dataDomain =
  process.env.NODE_ENV === "production"
    ? "0401m4q82jvo94b6huj99cavs903ogr42u8vd91bf89hvpbeh7nf42g.siasky.net"
    : "localhost";

export default skynetClient;
