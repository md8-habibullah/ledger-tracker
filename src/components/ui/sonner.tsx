import { Toaster as Sonner, toast } from "sonner";
import { useTheme } from "@/theme/ThemeProvider";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** The app's only toast system. Follows the Pearl/Vault theme. */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolved } = useTheme();

  return (
    <Sonner
      theme={resolved === "vault" ? "dark" : "light"}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-lg group-[.toaster]:bg-popover/90 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-popover-foreground group-[.toaster]:border-foreground/15 group-[.toaster]:shadow-2xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
