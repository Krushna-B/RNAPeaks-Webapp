"use client"

import { useState } from "react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { PlotGeneTab } from "@/components/tabs/PlotGeneTab"
import { PlotRegionTab } from "@/components/tabs/PlotRegionTab"
import { SplicingMapTab } from "@/components/tabs/SplicingMapTab"
import { SequenceMapTab } from "@/components/tabs/SequenceMapTab"
import { RISplicingMapTab } from "@/components/tabs/RISplicingMapTab"
import { RISequenceMapTab } from "@/components/tabs/RISequenceMapTab"
import { A5ssSplicingMapTab } from "@/components/tabs/A5ssSplicingMapTab"
import { A5ssSequenceMapTab } from "@/components/tabs/A5ssSequenceMapTab"
import { A3ssSplicingMapTab } from "@/components/tabs/A3ssSplicingMapTab"
import { A3ssSequenceMapTab } from "@/components/tabs/A3ssSequenceMapTab"
import { UtrBindingTab } from "@/components/tabs/UtrBindingTab"
import { ControlPeaksTab } from "@/components/tabs/ControlPeaksTab"
import { ThemeToggle } from "@/components/theme-provider"
import { BookOpen, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_GROUPS = [
  {
    label: "Peak Plotter",
    items: [
      { value: "plot-gene", label: "Plot Gene" },
      { value: "plot-region", label: "Plot Region" },
    ],
  },
  {
    label: "Splicing Analysis",
    items: [
      { value: "splicing-map", label: "Splicing Map" },
      { value: "sequence-map", label: "Sequence Map" },
      { value: "ri-splicing-map", label: "RI Splicing Map" },
      { value: "ri-sequence-map", label: "RI Sequence Map" },
      { value: "a5ss-splicing-map", label: "5' Splicing Map" },
      { value: "a5ss-sequence-map", label: "5' Sequence Map" },
      { value: "a3ss-splicing-map", label: "3' Splicing Map" },
      { value: "a3ss-sequence-map", label: "3' Sequence Map" },
    ],
  },
  {
    label: "UTR Analysis",
    items: [{ value: "utr-binding", label: "UTR Binding" }],
  },
  {
    label: "Control Peaks",
    items: [{ value: "control-peaks", label: "Control Peaks" }],
  },
] as const

export default function Home() {
  const [value, setValue] = useState("plot-gene")

  return (
    <Tabs
      value={value}
      onValueChange={setValue}
      className="flex h-screen flex-col gap-0 bg-background"
    >
      <header className="relative z-50 shrink-0 border-b bg-card/95 backdrop-blur-sm">
        <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-4 px-5">
          {/* Left: branding */}
          <div className="flex items-center">
            <span className="text-lg font-semibold tracking-tight">
              RNAPeaks
            </span>
          </div>

          {/* Center: grouped nav */}
          <nav className="flex items-center gap-1">
            {NAV_GROUPS.map((group) => {
              const groupActive = group.items.some((i) => i.value === value)
              const single = group.items.length === 1

              return (
                <div key={group.label} className="group relative">
                  <button
                    type="button"
                    onClick={
                      single ? () => setValue(group.items[0].value) : undefined
                    }
                    className={cn(
                      "flex h-9 items-center gap-1 rounded-md px-3 text-sm font-medium transition-colors",
                      groupActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    {group.label}
                    {!single && (
                      <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
                    )}
                  </button>

                  {!single && (
                    <div className="invisible absolute left-0 top-full z-50 min-w-44 pt-1.5 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100">
                      <div className="flex flex-col rounded-md border bg-popover p-1 shadow-md">
                        {group.items.map((item) => (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => setValue(item.value)}
                            className={cn(
                              "rounded-sm px-2.5 py-1.5 text-left text-sm transition-colors",
                              item.value === value
                                ? "bg-accent text-foreground"
                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            )}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Right: docs + theme toggle */}
          <div className="flex items-center justify-end gap-1">
            <a
              href="https://krushna-b.github.io/RNAPeaks/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 items-center gap-1.5 rounded-md border border-transparent px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Documentation
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <TabsContent
        value="plot-gene"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <PlotGeneTab />
      </TabsContent>
      <TabsContent
        value="plot-region"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <PlotRegionTab />
      </TabsContent>
      <TabsContent
        value="splicing-map"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <SplicingMapTab />
      </TabsContent>
      <TabsContent
        value="sequence-map"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <SequenceMapTab />
      </TabsContent>
      <TabsContent
        value="ri-splicing-map"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <RISplicingMapTab />
      </TabsContent>
      <TabsContent
        value="ri-sequence-map"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <RISequenceMapTab />
      </TabsContent>
      <TabsContent
        value="a5ss-splicing-map"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <A5ssSplicingMapTab />
      </TabsContent>
      <TabsContent
        value="a5ss-sequence-map"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <A5ssSequenceMapTab />
      </TabsContent>
      <TabsContent
        value="a3ss-splicing-map"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <A3ssSplicingMapTab />
      </TabsContent>
      <TabsContent
        value="a3ss-sequence-map"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <A3ssSequenceMapTab />
      </TabsContent>
      <TabsContent
        value="utr-binding"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <UtrBindingTab />
      </TabsContent>
      <TabsContent
        value="control-peaks"
        className="mt-0 min-h-0 flex-1 overflow-hidden"
      >
        <ControlPeaksTab />
      </TabsContent>
    </Tabs>
  )
}
