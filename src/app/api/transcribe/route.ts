import { containLegacyRoute } from "@/lib/server/containment";

// Speech will use bounded server-side admission. Never return provider keys.
export const POST = containLegacyRoute(null);
