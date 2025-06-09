
"use client";

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Edit, Trash2, GripVertical, MinusCircle, Palette } from 'lucide-react';
import type { CustomizationGroupDefinition, CustomizationGroupOptionDefinition, CustomizationGroupChoiceDefinition } from '@/types';
import { useForm, Controller, SubmitHandler, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const hexColorRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

const choiceDefinitionSchema = z.object({
  value: z.string().min(1, "Value is required"),
  label: z.string().min(1, "Label is required for dropdown choices"),
  priceAdjustment: z.coerce.number().optional().default(0),
});

const colorChoiceDefinitionSchema = z.object({
  value: z.string().regex(hexColorRegex, "Must be a valid hex color (e.g., #RGB or #RRGGBB)"),
  label: z.string().optional(),
  priceAdjustment: z.coerce.number().optional().default(0),
});

const optionDefinitionSchema = z.object({
  id: z.string().min(1, "Option ID is required (e.g., color_option)").regex(/^[a-zA-Z0-9_]+$/, "ID can only contain letters, numbers, and underscores"),
  label: z.string().min(1, "Option label is required"),
  type: z.enum(['dropdown', 'text', 'checkbox', 'image_upload', 'color_picker'], { required_error: "Option type is required." }),
  required: z.boolean().optional().default(false),
  showToCustomerByDefault: z.boolean().optional().default(true),
  choices: z.array(z.union([choiceDefinitionSchema, colorChoiceDefinitionSchema])).optional(),
  placeholder: z.string().optional(),
  maxLength: z.coerce.number().positive("Max length must be positive").optional(),
  checkboxLabel: z.string().optional(),
  priceAdjustmentIfChecked: z.coerce.number().optional().default(0),
  acceptedFileTypes: z.string().optional(), 
  maxFileSizeMB: z.coerce.number().positive("Max file size must be positive").optional(),
}).superRefine((data, ctx) => { 
    if (data.type === 'dropdown') {
        if (!data.choices || data.choices.length === 0) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one choice is required for 'Dropdown' type.", path: ["choices"] });
        } else {
          data.choices.forEach((choice, index) => {
            if (!choice.value || choice.value.trim() === '') {
               ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Value is required for choice ${index + 1}.`, path: [`choices.${index}.value`] });
            }
            if (!choice.label || choice.label.trim() === '') {
               ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Display Label is required for choice ${index + 1}.`, path: [`choices.${index}.label`] });
            }
          });
        }
    }
    if (data.type === 'checkbox' && (!data.checkboxLabel || data.checkboxLabel.trim() === '')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Checkbox label is required for 'Checkbox' type.", path: ["checkboxLabel"] });
    }
    if (data.type === 'color_picker') {
      if (!data.choices || data.choices.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "At least one color choice is required for 'Color Picker' type.", path: ["choices"] });
      } else {
        data.choices.forEach((choice, index) => {
          if (!hexColorRegex.test(choice.value)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Invalid hex color format for choice ${index + 1}. Use #RGB or #RRGGBB.`, path: [`choices.${index}.value`] });
          }
        });
      }
    }
});

const groupDefinitionFormSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  options: z.array(optionDefinitionSchema).min(0, "At least one customization option is recommended, but not required to save."),
});

type GroupDefinitionFormValues = z.infer<typeof groupDefinitionFormSchema>;

export default function AdminCustomizationsPage() {
  const { user, role, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [groups, setGroups] = useState<CustomizationGroupDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomizationGroupDefinition | null>(null);

  const form = useForm<GroupDefinitionFormValues>({
    resolver: zodResolver(groupDefinitionFormSchema),
    defaultValues: { name: "", options: [] },
  });

  const { fields: optionFields, append: appendOption, remove: removeOption } = useFieldArray({
    control: form.control,
    name: "options",
  });

  const fetchGroups = useCallback(async () => {
    if (!db) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const q = query(collection(db, 'customizationGroupDefinitions'), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      setGroups(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CustomizationGroupDefinition)));
    } catch (e: any) {
      console.error("Error fetching groups:", e);
      toast({ title: "Error", description: "Could not load customization groups.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading) {
      if (!user || role !== 'Admin') router.replace('/dashboard');
      else fetchGroups();
    }
  }, [user, role, authLoading, router, fetchGroups]);

  const handleOpenDialog = (group: CustomizationGroupDefinition | null = null) => {
    setEditingGroup(group);
    form.reset(group ? group : { name: "", options: [] });
    setIsDialogOpen(true);
  };

  const onSubmit: SubmitHandler<GroupDefinitionFormValues> = async (values) => {
    if (!db) return;
    setIsSubmitting(true);
    const dataToSave = {
      ...values,
      updatedAt: serverTimestamp(),
      ...(editingGroup ? {} : { createdAt: serverTimestamp() }),
    };

    try {
      if (editingGroup) {
        await updateDoc(doc(db, 'customizationGroupDefinitions', editingGroup.id), dataToSave);
        toast({ title: "Group Updated", description: `"${values.name}" updated.` });
      } else {
        await addDoc(collection(db, 'customizationGroupDefinitions'), dataToSave);
        toast({ title: "Group Created", description: `"${values.name}" created.` });
      }
      setIsDialogOpen(false); setEditingGroup(null); fetchGroups();
    } catch (e: any) {
      console.error("Save failed:", e);
      toast({ title: "Save Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleDeleteGroup = async (groupId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'customizationGroupDefinitions', groupId));
      toast({title: "Group Deleted", description: "Customization group has been deleted."});
      fetchGroups();
    } catch(e:any) {
      toast({title: "Error", description: "Failed to delete group.", variant: "destructive"});
    }
  };

  if (authLoading || isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-headline font-semibold">Customization Group Definitions</h1>
        <Button onClick={() => handleOpenDialog()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create Group
        </Button>
      </div>
      <p className="text-muted-foreground">
        Define reusable sets of customization options that can be applied to products.
      </p>

      {groups.length === 0 && !isLoading ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No customization groups defined yet.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map(group => (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle className="font-headline">{group.name}</CardTitle>
                <CardDescription>{group.options.length} option(s) defined.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm">
                <p className="font-medium mb-1">Options Summary:</p>
                {group.options.slice(0,3).map(opt => <Badge key={opt.id} variant="outline" className="mr-1 mb-1 capitalize">{opt.type.replace(/_/g, " ")}</Badge>)}
                {group.options.length > 3 && <Badge variant="outline">+{group.options.length - 3} more</Badge>}
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => handleOpenDialog(group)}><Edit className="mr-1 h-3 w-3"/>Edit</Button>
                <Button variant="destructive" size="sm" onClick={() => handleDeleteGroup(group.id)}><Trash2 className="mr-1 h-3 w-3"/>Delete</Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) setEditingGroup(null);}}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Edit" : "Create New"} Customization Group</DialogTitle>
            <DialogDescription>Define a reusable set of product customization options.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              <ScrollArea className="h-[calc(100vh-22rem)] md:h-[calc(80vh-12rem)] pr-6">
                <div className="space-y-6">
                  <Card>
                    <CardHeader><CardTitle className="text-lg">Group Details</CardTitle></CardHeader>
                    <CardContent>
                      <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Group Name</FormLabel><FormControl><Input {...field} placeholder="e.g., Standard Drinkware Options" /></FormControl><FormMessage /></FormItem>)} />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-lg">Customization Options in this Group</CardTitle>
                      <Button type="button" variant="outline" size="sm" onClick={() => appendOption({ id: `opt_${Date.now()}`, label: '', type: 'text', required: false, showToCustomerByDefault: true, choices:[], placeholder: '', checkboxLabel: ''})}>
                        <PlusCircle className="mr-2 h-4 w-4"/> Add Option
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {optionFields.length === 0 && <p className="text-sm text-muted-foreground">No options added yet. Click "Add Option" to begin.</p>}
                      {optionFields.map((field, index) => (
                        <RenderOptionField key={field.id} control={form.control} index={index} removeOption={removeOption} />
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
              <DialogFooter className="pt-4">
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingGroup ? "Save Changes" : "Create Group"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RenderOptionField({ control, index, removeOption }: { control: any, index: number, removeOption: (index: number) => void }) {
  const optionType = control.getValues(`options.${index}.type`); // Get current value directly

  return (
    <Card className="p-4 border bg-muted/50 relative">
      <div className="flex justify-between items-center mb-3">
        <h4 className="font-medium flex items-center text-md"><GripVertical className="mr-1 h-4 w-4 cursor-grab text-muted-foreground"/> Option {index + 1}</h4>
        <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(index)} className="absolute top-2 right-2"><MinusCircle className="h-4 w-4 text-destructive"/></Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
        <FormField control={control} name={`options.${index}.label`} render={({ field }) => (<FormItem><FormLabel>Display Label</FormLabel><FormControl><Input {...field} placeholder="e.g., Select Color, Engraving Text"/></FormControl><FormMessage/></FormItem>)} />
        <FormField control={control} name={`options.${index}.id`} render={({ field }) => (<FormItem><FormLabel>Option ID (Unique Key)</FormLabel><FormControl><Input {...field} placeholder="e.g., color_choice (no spaces)"/></FormControl><FormDescription className="text-xs">Internal key for this option.</FormDescription><FormMessage/></FormItem>)} />
      </div>
      <FormField control={control} name={`options.${index}.type`} render={({ field: typeField }) => (
        <FormItem className="mt-3"><FormLabel>Option Type</FormLabel>
          <Select onValueChange={(value) => { typeField.onChange(value); control.setValue(`options.${index}.type`, value); }} value={typeField.value}>
            <FormControl><SelectTrigger><SelectValue placeholder="Select option type" /></SelectTrigger></FormControl>
            <SelectContent>
              <SelectItem value="dropdown">Dropdown</SelectItem>
              <SelectItem value="text">Text Input</SelectItem>
              <SelectItem value="checkbox">Checkbox (Yes/No)</SelectItem>
              <SelectItem value="image_upload">Image Upload</SelectItem>
              <SelectItem value="color_picker">Color Picker</SelectItem>
            </SelectContent>
          </Select><FormMessage/>
        </FormItem>
      )} />

      {optionType === 'dropdown' && <RenderSelectChoicesConfig control={control} optionIndex={index} />}
      {optionType === 'color_picker' && <RenderColorChoicesConfig control={control} optionIndex={index} />}
      {optionType === 'text' && <RenderTextConfig control={control} optionIndex={index} />}
      {optionType === 'checkbox' && <RenderCheckboxConfig control={control} optionIndex={index} />}
      {optionType === 'image_upload' && <RenderImageUploadConfig control={control} optionIndex={index} />}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
        <FormField control={control} name={`options.${index}.required`} render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Required Option</FormLabel></FormItem> )} />
        <FormField control={control} name={`options.${index}.showToCustomerByDefault`} render={({ field }) => ( <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="font-normal">Show to Customer by Default</FormLabel></FormItem> )} />
      </div>
       <FormMessage>{control.getFieldState(`options.${index}`).error?.message}</FormMessage>
       <FormMessage>{control.getFieldState(`options.${index}.choices`)?.error?.message}</FormMessage>
    </Card>
  );
}

function RenderSelectChoicesConfig({ control, optionIndex }: { control: any, optionIndex: number }) {
  const { fields, append, remove } = useFieldArray({ control, name: `options.${optionIndex}.choices` });
  return (
    <div className="mt-3 space-y-3 p-3 border rounded-md bg-background">
      <div className="flex justify-between items-center"><h5 className="text-sm font-medium">Choices for Dropdown</h5><Button type="button" size="sm" variant="outline" onClick={() => append({ value: '', label: '', priceAdjustment: 0 })}><PlusCircle className="mr-1 h-3 w-3"/> Add Choice</Button></div>
      {fields.length === 0 && <p className="text-xs text-muted-foreground">No choices added yet.</p>}
      {fields.map((choiceField, choiceIndex) => (
        <div key={choiceField.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end p-2 border rounded bg-muted/20">
          <FormField control={control} name={`options.${optionIndex}.choices.${choiceIndex}.label`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Display Label</FormLabel><FormControl><Input {...field} placeholder="e.g., Red, Small"/></FormControl><FormMessage className="text-xs"/></FormItem>)} />
          <FormField control={control} name={`options.${optionIndex}.choices.${choiceIndex}.value`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Value (Unique)</FormLabel><FormControl><Input {...field} placeholder="e.g., red_option, size_sm"/></FormControl><FormMessage className="text-xs"/></FormItem>)} />
          <FormField control={control} name={`options.${optionIndex}.choices.${choiceIndex}.priceAdjustment`} render={({ field }) => (<FormItem><FormLabel className="text-xs">Price Adj. (KES)</FormLabel><FormControl><Input type="number" step="0.01" {...field} placeholder="0.00"/></FormControl><FormMessage className="text-xs"/></FormItem>)} />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(choiceIndex)} aria-label="Remove choice"><MinusCircle className="h-4 w-4 text-destructive"/></Button>
        </div>
      ))}
    </div>
  );
}

function RenderColorChoicesConfig({ control, optionIndex }: { control: any, optionIndex: number }) {
  const { fields, append, remove } = useFieldArray({ control, name: `options.${optionIndex}.choices` });
  return (
    <div className="mt-3 space-y-3 p-3 border rounded-md bg-background">
      <div className="flex justify-between items-center">
        <h5 className="text-sm font-medium">Color Choices</h5>
        <Button type="button" size="sm" variant="outline" onClick={() => append({ value: '#FFFFFF', label: '' })}>
          <Palette className="mr-1 h-3 w-3"/> Add Color
        </Button>
      </div>
      {fields.length === 0 && <p className="text-xs text-muted-foreground">No color choices added yet.</p>}
      {fields.map((choiceField, choiceIndex) => (
        <div key={choiceField.id} className="grid grid-cols-1 sm:grid-cols-[auto_1fr_1fr_auto] gap-3 items-center p-2 border rounded bg-muted/20">
          <Controller
            control={control}
            name={`options.${optionIndex}.choices.${choiceIndex}.value`}
            render={({ field }) => (
              <div 
                className="w-8 h-8 rounded-md border" 
                style={{ backgroundColor: field.value && hexColorRegex.test(field.value) ? field.value : 'transparent' }}
                title={field.value}
              />
            )}
          />
          <FormField control={control} name={`options.${optionIndex}.choices.${choiceIndex}.value`} render={({ field }) => (
            <FormItem><FormLabel className="text-xs">Hex Color Value</FormLabel><FormControl><Input {...field} placeholder="#RRGGBB" className="h-9"/></FormControl><FormMessage className="text-xs"/></FormItem>
          )} />
          <FormField control={control} name={`options.${optionIndex}.choices.${choiceIndex}.label`} render={({ field }) => (
            <FormItem><FormLabel className="text-xs">Color Name (Optional)</FormLabel><FormControl><Input {...field} placeholder="e.g., Ruby Red" className="h-9"/></FormControl><FormMessage className="text-xs"/></FormItem>
          )} />
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(choiceIndex)} aria-label="Remove color choice">
            <MinusCircle className="h-4 w-4 text-destructive"/>
          </Button>
        </div>
      ))}
    </div>
  );
}

function RenderTextConfig({ control, optionIndex }: { control: any, optionIndex: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
      <FormField control={control} name={`options.${optionIndex}.placeholder`} render={({ field }) => (<FormItem><FormLabel>Placeholder Text</FormLabel><FormControl><Input {...field} placeholder="e.g., Enter your text here"/></FormControl><FormMessage/></FormItem>)} />
      <FormField control={control} name={`options.${optionIndex}.maxLength`} render={({ field }) => (<FormItem><FormLabel>Max Length (Optional)</FormLabel><FormControl><Input type="number" {...field} placeholder="e.g., 50"/></FormControl><FormMessage/></FormItem>)} />
    </div>
  );
}

function RenderCheckboxConfig({ control, optionIndex }: { control: any, optionIndex: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
      <FormField control={control} name={`options.${optionIndex}.checkboxLabel`} render={({ field }) => (<FormItem><FormLabel>Checkbox Label for Customer</FormLabel><FormControl><Input {...field} placeholder="e.g., Include gift wrapping?"/></FormControl><FormDescription className="text-xs">This text appears next to the checkbox.</FormDescription><FormMessage/></FormItem>)} />
      <FormField control={control} name={`options.${optionIndex}.priceAdjustmentIfChecked`} render={({ field }) => (<FormItem><FormLabel>Price Adj. if Checked (KES)</FormLabel><FormControl><Input type="number" step="0.01" {...field} placeholder="0.00"/></FormControl><FormMessage/></FormItem>)} />
    </div>
  );
}

function RenderImageUploadConfig({ control, optionIndex }: { control: any, optionIndex: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
      <FormField control={control} name={`options.${optionIndex}.acceptedFileTypes`} render={({ field }) => (<FormItem><FormLabel>Accepted File Types</FormLabel><FormControl><Input {...field} placeholder="e.g., .png, .jpg, .jpeg"/></FormControl><FormDescription className="text-xs">Comma-separated list of extensions.</FormDescription><FormMessage/></FormItem>)} />
      <FormField control={control} name={`options.${optionIndex}.maxFileSizeMB`} render={({ field }) => (<FormItem><FormLabel>Max File Size (MB)</FormLabel><FormControl><Input type="number" {...field} placeholder="e.g., 5"/></FormControl><FormMessage/></FormItem>)} />
    </div>
  );
}
