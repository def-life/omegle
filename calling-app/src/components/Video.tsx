import { useEffect, useRef } from "react";

interface VideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
    stream: MediaStream | null
    
}

export default function Video(props: VideoProps) {
    const {stream, ...rest} = props;
    const videoRef = useRef<HTMLVideoElement | null>(null);


    useEffect(() => {
        if(stream && videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    }, [stream, videoRef.current])

    return (
       <video ref={videoRef}  {...rest}>
       </video>
    )
}