# Components

Grouped by the surface each component serves. Nothing lives at the top level.

| Folder | Holds |
| --- | --- |
| `archive/` | Panels and metric tiles shared by the all-time archive routes |
| `auth/` | Sign-in and connected-account controls |
| `charts/` | Every Recharts and canvas chart, plus `chart-primitives` |
| `chat/` | Clutch conversation surface |
| `comments/` | Race comment threads and moderation |
| `entities/` | Driver, constructor, and circuit panels and tables |
| `favorites/` | Favorites picker and prompts |
| `home/` | Home page sections |
| `layout/` | Shell, navigation, footer, page headers, background patterns |
| `providers/` | React context providers mounted in the root layout |
| `session/` | Race-weekend session detail and its analysis panels |
| `standings/` | Championship tables, badges, and scoring controls |
| `track/` | Track maps, static and interactive |
| `ui/` | Primitives with no domain knowledge: buttons, skeletons, tabs, deferred sections |

Two conventions worth keeping:

- Import siblings relatively (`./ChartPrimitives`) and anything else by alias
  (`@/components/charts/…`). Reaching into another folder is a signal the
  component may belong somewhere else.
- No barrel files. Charts are dynamically imported by route code, and a barrel
  would pull the whole family into a shared chunk.
