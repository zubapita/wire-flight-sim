import { FlightSimulatorApp } from "@/features/flight-sim/view/FlightSimulatorApp";

type SearchParams = {
  safeMode?: string | string[];
};

type HomeProps = {
  searchParams?: Promise<SearchParams> | SearchParams;
};

export default async function Home({ searchParams }: HomeProps) {
  const resolvedSearchParams = searchParams ? await Promise.resolve(searchParams) : {};
  const safeModeParam = resolvedSearchParams.safeMode;
  const initialSafeMode =
    typeof safeModeParam === "string"
      ? safeModeParam === "1"
      : Array.isArray(safeModeParam) && safeModeParam.includes("1");

  return <FlightSimulatorApp initialSafeMode={initialSafeMode} />;
}
