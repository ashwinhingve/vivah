'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Heart, Mail, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import {
  CardListSkeleton,
  Container,
  DataTable,
  EmptyState,
  ErrorState,
  FilterSheet,
  Form,
  FormField,
  MaskedField,
  PageHeader,
  ProfileDetailSkeleton,
  Section,
  StickyActionBar,
  TableSkeleton,
} from '@/components/shared';

type Payout = { id: string; vendor: string; amount: number; status: 'paid' | 'pending' };

const PAYOUTS: Payout[] = [
  { id: 'po_1', vendor: 'Roshan Studios', amount: 24500, status: 'paid' },
  { id: 'po_2', vendor: 'Bombay Catering', amount: 89000, status: 'pending' },
  { id: 'po_3', vendor: 'Mehndi by Anita', amount: 12000, status: 'paid' },
];

export function UIKitClient() {
  const form = useForm<{ name: string; religion: string }>({
    defaultValues: { name: '', religion: '' },
  });

  return (
    <main className="min-h-screen bg-background py-8">
      <Container variant="default" className="space-y-12">
        <PageHeader
          eyebrow="Smart Shaadi"
          title="UI Kit Sandbox"
          subtitle="Every primitive + shared layout component, rendered for visual verification. Dev only."
          action={<Button variant="primary">Reset</Button>}
        />

        {/* ── Buttons ── */}
        <Section title="Buttons" description="Variants and sizes">
          <div className="flex flex-wrap gap-3">
            <Button>Default (teal)</Button>
            <Button variant="primary">Primary (burgundy)</Button>
            <Button variant="gold">Gold</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="subtle">Subtle</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button>Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Favorite">
              <Heart aria-hidden="true" />
            </Button>
          </div>
        </Section>

        {/* ── Badges ── */}
        <Section title="Badges">
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
          </div>
        </Section>

        {/* ── Card ── */}
        <Section title="Card">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Match score 86%</CardTitle>
              <CardDescription>4 of 8 Ashtakoot matched</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Body content lives here. Card uses surface bg, border, and shadow-card.
              </p>
            </CardContent>
          </Card>
        </Section>

        {/* ── Form primitives ── */}
        <Section title="Form (react-hook-form + FormField)">
          <Form {...form}>
            <form className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                rules={{ required: 'Name is required' }}
                label="Full name"
                description="As on your KYC document"
                required
              >
                {(field) => <Input placeholder="Anjali Sharma" {...field} value={field.value ?? ''} />}
              </FormField>

              <FormField
                control={form.control}
                name="religion"
                rules={{ required: 'Pick a religion' }}
                label="Religion"
                required
              >
                {(field) => (
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select religion" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hindu">Hindu</SelectItem>
                      <SelectItem value="muslim">Muslim</SelectItem>
                      <SelectItem value="sikh">Sikh</SelectItem>
                      <SelectItem value="christian">Christian</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </FormField>

              <div className="space-y-2">
                <Label htmlFor="newsletter" className="flex items-center gap-2">
                  <Checkbox id="newsletter" />
                  <span>Subscribe to weekly matches</span>
                </Label>
              </div>

              <div className="space-y-2">
                <Label>Looking for</Label>
                <RadioGroup defaultValue="bride" className="flex gap-4">
                  <Label className="flex items-center gap-2">
                    <RadioGroupItem value="bride" />
                    Bride
                  </Label>
                  <Label className="flex items-center gap-2">
                    <RadioGroupItem value="groom" />
                    Groom
                  </Label>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center justify-between">
                  <span>Photo hidden</span>
                  <Switch />
                </Label>
              </div>

              <div className="sm:col-span-2">
                <Button type="button" variant="primary" onClick={form.handleSubmit(() => {})}>
                  Submit
                </Button>
              </div>
            </form>
          </Form>
        </Section>

        {/* ── Progress ── */}
        <Section title="Progress">
          <div className="space-y-3">
            <Progress value={42} />
            <Progress value={86} />
          </div>
        </Section>

        {/* ── Accordion ── */}
        <Section title="Accordion">
          <Accordion type="single" collapsible>
            <AccordionItem value="a">
              <AccordionTrigger>Why was this match suggested?</AccordionTrigger>
              <AccordionContent>
                Reciprocal preferences matched on language, education, and city. Guna score is 28/36.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="b">
              <AccordionTrigger>What is Manglik?</AccordionTrigger>
              <AccordionContent>
                Vedic compatibility marker derived from Mars placement. See Horoscope tab for details.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Section>

        {/* ── Dialog / Sheet / Popover / Dropdown ── */}
        <Section title="Overlays">
          <div className="flex flex-wrap gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Open dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirm interest</DialogTitle>
                  <DialogDescription>Send your interest to Anjali Sharma?</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button variant="primary">
                    <Sparkles aria-hidden="true" />
                    Send interest
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline">Open sheet (right)</Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <p className="mt-4 text-sm text-muted-foreground">Sheet body content.</p>
              </SheetContent>
            </Sheet>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">Popover</Button>
              </PopoverTrigger>
              <PopoverContent>
                <p className="text-sm">Popover body — verify portal + focus trap.</p>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <User aria-hidden="true" />
                  Account
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>My account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuItem>Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </Section>

        {/* ── DataTable ── */}
        <Section title="DataTable" description="Desktop table + mobile card-list. Resize the window.">
          <DataTable
            columns={[
              { key: 'vendor', header: 'Vendor' },
              {
                key: 'amount',
                header: 'Amount',
                render: (r) => `₹${r.amount.toLocaleString('en-IN')}`,
              },
              {
                key: 'status',
                header: 'Status',
                render: (r) => (
                  <span
                    className={
                      r.status === 'paid'
                        ? 'text-success font-medium'
                        : 'text-warning font-medium'
                    }
                  >
                    {r.status}
                  </span>
                ),
              },
            ]}
            data={PAYOUTS}
            rowKey={(r) => r.id}
            empty={{ title: 'No payouts yet', description: 'Payouts appear here after fulfilment.' }}
          />
        </Section>

        <Section title="DataTable — empty">
          <DataTable
            columns={[
              { key: 'a', header: 'A' },
              { key: 'b', header: 'B' },
            ]}
            data={[]}
            rowKey={(_r, i) => String(i)}
            empty={{ title: 'Nothing to see yet', description: 'Try a wider search.' }}
          />
        </Section>

        <Section title="DataTable — loading">
          <DataTable
            columns={[
              { key: 'a', header: 'A' },
              { key: 'b', header: 'B' },
              { key: 'c', header: 'C' },
              { key: 'd', header: 'D' },
            ]}
            data={[]}
            rowKey={(_r, i) => String(i)}
            loading
          />
        </Section>

        {/* ── EmptyState / ErrorState ── */}
        <Section title="EmptyState + ErrorState">
          <div className="grid gap-4 sm:grid-cols-2">
            <EmptyState
              icon={Heart}
              title="No likes yet"
              description="Browse the feed to send your first interest."
              action={<Button variant="primary">Browse feed</Button>}
            />
            <ErrorState
              title="Couldn't load matches"
              description="Network blip. Try again in a moment."
              action={<Button variant="outline">Retry</Button>}
            />
          </div>
        </Section>

        {/* ── Skeletons ── */}
        <Section title="Skeletons">
          <div className="space-y-6">
            <TableSkeleton rows={3} cols={4} />
            <CardListSkeleton count={3} columns={3} />
            <ProfileDetailSkeleton />
          </div>
        </Section>

        {/* ── MaskedField ── */}
        <Section title="MaskedField" description="Phone/email reveal — locked vs unlocked.">
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-xs uppercase text-gold-muted">Locked</p>
              <MaskedField value="+919876543210" />
            </div>
            <div>
              <p className="text-xs uppercase text-gold-muted">Unlocked phone</p>
              <MaskedField value="+919876543210" unlocked />
            </div>
            <div>
              <p className="text-xs uppercase text-gold-muted">Unlocked email</p>
              <MaskedField value="anjali@example.com" kind="email" unlocked />
            </div>
          </div>
        </Section>

        {/* ── FilterSheet (full layout demo) ── */}
        <Section title="FilterSheet" description="Mobile bottom-sheet + desktop sidebar.">
          <ToggleSheetDemo />
        </Section>

        {/* ── StickyActionBar ── */}
        <Section title="StickyActionBar" description="Mobile only. Resize to <640px to see it.">
          <p className="text-sm text-muted-foreground">Look at the bottom of the viewport on a narrow window.</p>
          <StickyActionBar>
            <Button variant="outline" size="sm">Save</Button>
            <Button variant="primary" size="sm">Send interest</Button>
          </StickyActionBar>
        </Section>

        {/* spacer so StickyActionBar doesn't cover content */}
        <div className="h-24" aria-hidden="true" />
      </Container>
    </main>
  );
}

function ToggleSheetDemo() {
  const [tier, setTier] = useState('any');
  const filters = (
    <div className="space-y-4">
      <RadioGroup value={tier} onValueChange={setTier} className="space-y-2">
        <Label className="flex items-center gap-2">
          <RadioGroupItem value="any" /> Any
        </Label>
        <Label className="flex items-center gap-2">
          <RadioGroupItem value="verified" /> KYC verified
        </Label>
        <Label className="flex items-center gap-2">
          <RadioGroupItem value="premium" /> Premium
        </Label>
      </RadioGroup>
      <div className="flex items-center justify-between">
        <Label htmlFor="hide-photo" className="text-sm">
          Hide profiles without photo
        </Label>
        <Switch id="hide-photo" />
      </div>
      <Button variant="primary" size="sm">Apply</Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <FilterSheet activeCount={tier === 'any' ? 0 : 1}>{filters}</FilterSheet>
      <div className="flex-1 rounded-xl border border-border bg-secondary/40 p-6 text-center text-sm text-muted-foreground">
        Result list goes here. Tier: <span className="font-semibold text-primary">{tier}</span>
        {' · '}
        <span>
          On mobile, the &quot;Filters&quot; trigger above opens a bottom sheet. On desktop, the sidebar is shown alongside.
        </span>
        <div className="mt-4">
          <Mail aria-hidden="true" className="mx-auto h-6 w-6 text-gold" />
        </div>
      </div>
    </div>
  );
}
