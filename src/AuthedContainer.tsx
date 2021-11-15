import {Link} from "react-router-dom";
import {useMysky} from "./MyskyProvider";

export default function AuthedContainer({
  onLogout,
  children,
}: {
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const {userId} = useMysky();

  if (userId == null) {
    return <>children</>;
  }
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#00a000",
          color: "white",
          height: "2em",
        }}
      >
        <div style={{display: "flex", alignItems: "center", height: "100%"}}>
          <Link style={{height: "100%"}} to="/">
            <img
              src="/mstile-70x70.png"
              style={{height: "100%"}}
              alt="SkyChat logo"
            />
          </Link>
          <Link style={{textDecoration: "none", color: "inherit"}} to="/">
            <span style={{fontSize: "1em"}}>SkyChat</span>
          </Link>
        </div>
        <div style={{paddingRight: "0.5em"}}>
          <button onClick={onLogout}>Logout</button>
        </div>
      </div>
      <div
        style={{
          flex: "1",
          minHeight: 0,
          maxWidth: 1000,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}
