import { CustomFieldConfig } from '../types';

interface CustomFieldRendererProps {
  field: CustomFieldConfig;
  value: string | string[];
  onChange: (fieldId: string, value: string | string[]) => void;
}

export const CustomFieldRenderer = ({ field, value, onChange }: CustomFieldRendererProps) => {
  const handleChange = (newValue: string | string[]) => {
    onChange(field.id, newValue);
  };

  switch (field.type) {
    case 'text':
      return (
        <input
          type="text"
          value={value as string}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
        />
      );
    case 'number':
      return (
        <input
          type="number"
          value={value as string}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
        />
      );
    case 'textarea':
      return (
        <textarea
          value={value as string}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow] resize-none"
        />
      );
    case 'select':
      return (
        <select
          value={value as string}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
        >
          <option value="">请选择</option>
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      );
    case 'multiselect':
      return (
        <div className="space-y-2">
          {field.options?.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={(value as string[]).includes(opt.value)}
                onChange={(e) => {
                  const current = value as string[];
                  if (e.target.checked) {
                    handleChange([...current, opt.value]);
                  } else {
                    handleChange(current.filter((v) => v !== opt.value));
                  }
                }}
                className="rounded border-border/50"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      );
    case 'date':
      return (
        <input
          type="date"
          value={value as string}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full bg-background border border-border/50 px-3 py-2 rounded-md focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-[border-color,box-shadow]"
        />
      );
    default:
      return null;
  }
};
