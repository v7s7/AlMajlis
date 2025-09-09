import { Link } from "react-router-dom";
export default function NotFound(){
  return (
    <div style={{padding:16}}>
      <h2>Page not found</h2>
      <Link to="/"><button>Go Home</button></Link>
    </div>
  );
}
