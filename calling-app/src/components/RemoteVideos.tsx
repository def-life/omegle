import Video from "./Video";

interface RemoteVideosProps {
    streams: MediaStream[]
}

export default function RemoteVideos(props: RemoteVideosProps) {
    const {streams} = props;


    function switchVideo(stream: MediaStream) {
        return () => {

        }
    }
    return <div
    style={{
        height: 110,
        zIndex: 1,
        position: "fixed",
        right: 10,
        bottom: 10,
        left: 10,
        backgroundColor: "rgba(0, 0, 0, 0.3)",
        overflowX: "scroll",
        whiteSpace: "nowrap",
        padding: "6px 3px"
    }}>
        {streams.map((stream) => {
            return <div style={{display: "inline-block"}} onClick={switchVideo(stream)} key={stream.id}>
                 <Video style={{width: 120, padding: "0 3px", float: "left"}} key={stream.id} stream={stream} />
                </div>
        } )}

    </div>
}