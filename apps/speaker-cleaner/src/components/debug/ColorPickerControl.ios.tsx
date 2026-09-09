import { ColorPicker, Host } from '@expo/ui/swift-ui'

export type ColorPickerControlProps = {
  value: string
  onValueChange: (value: string) => void
}

export const ColorPickerControl = ({ value, onValueChange }: ColorPickerControlProps) => (
  <Host matchContents ignoreSafeArea="all">
    <ColorPicker label="Edit" selection={value} supportsOpacity onSelectionChange={onValueChange} />
  </Host>
)
