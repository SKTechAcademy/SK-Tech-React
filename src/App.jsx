import {useEffect,useRef} from'react';import'./App.css';

export default function App(){
  const frame=useRef(null)
  useEffect(()=>{
    const sync=()=>{
      try{
        const path=frame.current?.contentWindow?.location?.pathname||''
        document.title=path.endsWith('interviews.html')?'SK Tech Interview Dashboard':'SK Tech Academy | Your Future, Our Mission'
      }catch{/* Same-origin preview and deployment keep this accessible. */}
    }
    const node=frame.current
    node?.addEventListener('load',sync)
    return()=>node?.removeEventListener('load',sync)
  },[])
  return <iframe ref={frame} className="site-frame" src="./site/index.html" title="SK Tech Academy website"/>
}
