import { MatchAnalysisPage } from "@/components/pubg/match-analysis-page"

export default async function Page({
  params,
}: {
  params: Promise<{ matchId: string }>
}) {
  const { matchId } = await params
  return <MatchAnalysisPage matchId={matchId} />
}
