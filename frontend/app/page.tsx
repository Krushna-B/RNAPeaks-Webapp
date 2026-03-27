"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlotGeneTab } from "@/components/tabs/PlotGeneTab"
import { PlotRegionTab } from "@/components/tabs/PlotRegionTab"
import { SplicingMapTab } from "@/components/tabs/SplicingMapTab"
import { SequenceMapTab } from "@/components/tabs/SequenceMapTab"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">RNAPeaks</h1>
            <p className="text-sm text-muted-foreground">
              RNA-binding protein peak visualization &amp; analysis
            </p>
          </div>
          <a
            href="https://github.com/Krushna-B/RNAPeaks"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Docs →
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="plot-gene">
          <TabsList className="mb-6">
            <TabsTrigger value="plot-gene">Plot Gene</TabsTrigger>
            <TabsTrigger value="plot-region">Plot Region</TabsTrigger>
            <TabsTrigger value="splicing-map">Splicing Map</TabsTrigger>
            <TabsTrigger value="sequence-map">Sequence Map</TabsTrigger>
          </TabsList>

          <TabsContent value="plot-gene">
            <PlotGeneTab />
          </TabsContent>
          <TabsContent value="plot-region">
            <PlotRegionTab />
          </TabsContent>
          <TabsContent value="splicing-map">
            <SplicingMapTab />
          </TabsContent>
          <TabsContent value="sequence-map">
            <SequenceMapTab />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
