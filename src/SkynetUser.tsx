import {IUserProfile} from "@skynethub/userprofile-library/dist/types";
import Color from "color";
import {useEffect, useState} from "react";
import {useMysky} from "./MyskyProvider";
import skynetClient from "./skynetClient";

type UserId = string;

function getBgColorForHexString(s: string): Color {
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < s.length; ) {
    const rByte = (s.substr(i, 2) + "00").substr(0, 2);
    const gByte = (s.substr(i + 2, 2) + "00").substr(0, 2);
    const bByte = (s.substr(i + 4, 2) + "00").substr(0, 2);
    i += 6;
    r ^= parseInt(rByte, 16);
    g ^= parseInt(gByte, 16);
    b ^= parseInt(bByte, 16);
  }
  return Color.rgb(r, g, b);
}

function SkynetId({id, style}: {id: UserId; style?: React.CSSProperties}) {
  return (
    <span
      style={{
        padding: "0.2em",
        fontWeight: "bold",
        borderRadius: "5px",
        ...style,
        backgroundColor: getBgColorForHexString(id).hex(),
        color: getBgColorForHexString(id).isDark() ? "white" : "black",
      }}
    >{`${id.substr(0, 5)}...${id.substr(-5)}`}</span>
  );
}

export default function SkynetUser({
  id,
  style,
  showDetails = false,
}: {
  id: UserId;
  style?: React.CSSProperties;
  showDetails?: boolean;
}) {
  const {getUserProfile} = useMysky();
  const [profile, setProfile] = useState<null | IUserProfile>(null);
  const [profileImgSrc, setProfileImgSrc] = useState<null | string>(null);
  useEffect(() => {
    if (getUserProfile) {
      getUserProfile(id).then((profile) => {
        setProfile(profile);
        if (profile.avatar && profile.avatar.length > 0) {
          skynetClient.getSkylinkUrl(profile.avatar[0].url).then((url) => {
            setProfileImgSrc(url);
          });
        }
      });
    }
    return () => {
      setProfile(null);
    };
  }, [getUserProfile, setProfile, id]);

  if (profile == null) {
    return <SkynetId id={id} style={style} />;
  }

  if (profile.username === "anonymous") {
    return <SkynetId id={id} style={style} />;
  }

  console.log(profile);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        ...style,
      }}
    >
      {profileImgSrc != null ? (
        <img
          src={profileImgSrc}
          style={{
            width: "1.8em",
            height: "1.8em",
            borderRadius: "50%",
            marginRight: "0.5em",
            alignSelf: "center",
            backgroundColor: "#fff",
            border: "1px solid #aaa",
            // marginTop: "-0.15em",
          }}
          alt="Avatar"
        />
      ) : null}
      <span
        style={{
          fontWeight: "bold",
          alignItems: "baseline",
          padding: "0.4em",
          borderRadius: "5px",
          backgroundColor: "#ddd",
        }}
      >
        {profile.username}
      </span>
      {showDetails && (profile.firstName || profile.lastName) ? (
        <>
          &nbsp;
          <span>{`(${profile.firstName || ""} ${
            profile.lastName || ""
          })`}</span>
        </>
      ) : null}
    </div>
  );
}
