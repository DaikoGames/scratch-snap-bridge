import { createFileRoute } from "@tanstack/react-router";
import { Converter } from "@/components/Converter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Scratch to Snap! Converter" },
      {
        name: "description",
        content:
          "Convert Scratch (.sb2 / .sb3) projects to Snap! BYOB XML right in your browser.",
      },
      { property: "og:title", content: "Scratch to Snap! Converter" },
      {
        property: "og:description",
        content: "Drop a Scratch project file and get a Snap! .xml back. Runs entirely in the browser.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Converter />
    </div>
  );
}
