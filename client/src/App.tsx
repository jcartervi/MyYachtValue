import * as React from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import HeroHeader from "@/components/HeroHeader";
import BoatValuationPage from "@/pages/BoatValuation";
import NotFound from "@/pages/NotFound";

function Redirect({ to }: { to: string }) {
  const [, setLocation] = useLocation();

  React.useEffect(() => {
    setLocation(to);
  }, [setLocation, to]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={BoatValuationPage} />
      <Route path="/boat-valuation" component={BoatValuationPage} />
      <Route path="/get-estimate" component={BoatValuationPage} />
      <Route path="/valuation">
        {() => <Redirect to="/boat-valuation" />}
      </Route>
      <Route path="/results">
        {() => <Redirect to="/boat-valuation" />}
      </Route>
      <Route path="/estimate">
        {() => <Redirect to="/boat-valuation" />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <HeroHeader />
          <main id="estimate" className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6">
            <Router />
          </main>
        </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
