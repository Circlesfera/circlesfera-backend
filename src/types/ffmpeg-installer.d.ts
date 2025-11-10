declare module 'ffmpeg-static' {
  const ffmpegStatic: string | null | { path: string };
  export default ffmpegStatic;
}

declare module 'ffprobe-static' {
  const ffprobeStatic: {
    path: string;
  };
  export default ffprobeStatic;
}
