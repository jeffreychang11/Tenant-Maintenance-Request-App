import { createProperty } from "@/app/(landlord)/properties/actions";

export default function NewPropertyPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-medium">Add a property</h1>
      <form action={createProperty} className="mt-8 flex flex-col gap-4">
        <div>
          <label htmlFor="name" className="block text-sm text-zinc-600 dark:text-zinc-400">
            Property name
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="123 Main St"
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
          />
        </div>
        <div>
          <label htmlFor="address_line1" className="block text-sm text-zinc-600 dark:text-zinc-400">
            Street address
          </label>
          <input
            id="address_line1"
            name="address_line1"
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="city" className="block text-sm text-zinc-600 dark:text-zinc-400">
              City
            </label>
            <input
              id="city"
              name="city"
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
            />
          </div>
          <div>
            <label htmlFor="state" className="block text-sm text-zinc-600 dark:text-zinc-400">
              State
            </label>
            <input
              id="state"
              name="state"
              className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
            />
          </div>
        </div>
        <div>
          <label htmlFor="postal_code" className="block text-sm text-zinc-600 dark:text-zinc-400">
            ZIP code
          </label>
          <input
            id="postal_code"
            name="postal_code"
            className="mt-1 w-full rounded-md border border-black/10 px-3 py-2 dark:border-white/20 dark:bg-black"
          />
        </div>
        <button
          type="submit"
          className="mt-2 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Create property
        </button>
      </form>
    </div>
  );
}
