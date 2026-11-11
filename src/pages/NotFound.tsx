import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const { pathname } = useLocation();
  return (
    <div className="glass mx-auto my-14 grid w-[min(32rem,calc(100%-2rem))] gap-4 p-8">
      <h1 className="text-[2rem] leading-10">That page does not exist</h1>
      <p className="text-muted-foreground">
        Nothing lives at <span className="figure break-all">{pathname}</span>. Check the address, or go somewhere that does exist.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild><Link to="/">Home</Link></Button>
        <Button asChild variant="outline"><Link to="/app">Open my vault</Link></Button>
      </div>
    </div>
  );
}
