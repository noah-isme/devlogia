import proxy from "./src/proxy";

export default proxy;

export const config = {
  matcher: ["/admin/:path*"],
};
