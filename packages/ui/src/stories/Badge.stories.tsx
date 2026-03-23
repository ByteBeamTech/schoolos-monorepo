import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from '../components/Badge'

const meta: Meta<typeof Badge> = {
  title: 'SchoolOS/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['info', 'success', 'warning', 'danger', 'neutral'] },
  },
}

export default meta
type Story = StoryObj<typeof Badge>

export const Info:    Story = { args: { children: 'Active',    variant: 'info' } }
export const Success: Story = { args: { children: 'Paid',      variant: 'success' } }
export const Warning: Story = { args: { children: 'Overdue',   variant: 'warning' } }
export const Danger:  Story = { args: { children: 'Suspended', variant: 'danger' } }
export const Neutral: Story = { args: { children: 'Draft',     variant: 'neutral' } }
