import { MatchAnalysisPage } from "@/components/pubg/match-analysis-page"
import type { Platform } from "@/lib/pubg/types"

function isPlatform(value: string | undefined): value is Platform {
  return (
    value === "steam" ||
    value === "kakao" ||
    value === "psn" ||
    value === "xbox"
  )
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { matchId } = await params
  const query = await searchParams
  const platformValue =
    typeof query.platform === "string" ? query.platform : undefined
  const playerId = typeof query.playerId === "string" ? query.playerId : ""
  return (
    <MatchAnalysisPage
      matchId={matchId}
      initialPlatform={isPlatform(platformValue) ? platformValue : "steam"}
      initialPlayerId={playerId}
    />
  )
}
