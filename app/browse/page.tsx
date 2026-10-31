import { redirect } from "next/navigation";

// /browse is superseded by /notes and /accords in Distillerie
export default function BrowsePage() {
  redirect("/notes");
}
