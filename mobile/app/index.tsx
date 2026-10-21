import { Redirect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useMembership } from "@/lib/membership";

export default function Index() {
  const { session, loading } = useAuth();
  const { member } = useMembership();
  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/welcome" />;
  // Wait for the answer, so someone without a code never glimpses Discover.
  if (member === null) return null;
  return member ? <Redirect href="/(tabs)/connect" /> : <Redirect href="/invite" />;
}
