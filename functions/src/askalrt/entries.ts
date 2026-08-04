/**
 * Ask ALRT pre-written answer library (zero AI).
 *
 * These answers are the FIRST line of response — matched by matching.ts before
 * any model is called. Answers are written to the locked product rules so they
 * stay accurate (no phone numbers, 2-state location, hold-3s SOS, 1-month trial,
 * host-pays seats, no en-dashes). Edit freely; add rows as questions come up.
 *
 * To make these editable without a release, they can later be moved to a
 * Firestore collection or Remote Config and merged over this seed (see README).
 */
import { KnowledgeEntry } from "./matching";

export const KNOWLEDGE_BASE: readonly KnowledgeEntry[] = [
  {
    id: "what_is_alrt",
    triggers: ["what is alrt", "what does this app do", "how does alrt work"],
    keywords: ["about", "alrt", "purpose"],
    answer:
      "ALRT is a real time safety alert app. It shows official and community hazard alerts near you on a map and in a list, and it has a Family layer so your circle can share a location snapshot or reach each other in an emergency.",
  },
  {
    id: "send_sos",
    triggers: ["how do i send an sos", "send sos", "start an sos", "trigger sos"],
    keywords: ["sos", "emergency", "help"],
    answer:
      "Open the SOS screen, then hold the button for 3 seconds. You get a confirm screen showing exactly who will be alerted, a short countdown, and a 12 second undo after it sends. SOS alerts the people in your circle, it does not contact emergency services.",
  },
  {
    id: "sos_who",
    triggers: ["who gets my sos", "who receives sos", "who is alerted"],
    keywords: ["sos", "recipients", "who"],
    answer:
      "Your SOS goes to the recipient list you pick on the SOS screen (Everyone by default). You set up those lists ahead of time in Family settings, so you never have to choose during an emergency.",
  },
  {
    id: "snapshot",
    triggers: ["what is a snapshot", "share my location", "send my location", "location snapshot"],
    keywords: ["snapshot", "location", "share"],
    answer:
      "A snapshot is a single point that shows where you are right now. You send it on purpose, it fades and is deleted after 60 minutes, and it never keeps a history. ALRT never tracks a person continuously, the only live sharing is inside an active SOS.",
  },
  {
    id: "live_tracking",
    triggers: ["track someone", "live tracking", "follow someone", "see where they are all the time"],
    keywords: ["track", "tracking", "continuous", "monitor"],
    answer:
      "ALRT does not track people continuously. You can send a one time snapshot that expires in an hour, and live sharing exists only during an active SOS and stops on its own after 4 hours. Watching a place forever is a map feature, watching a person forever is not something the app does.",
  },
  {
    id: "family_circle",
    triggers: ["create a circle", "create a family", "set up family", "family group", "add family"],
    keywords: ["circle", "family", "group"],
    answer:
      "Go to the Family tab to create a circle and invite people with a link, QR code, or short code. You can have several circles (for example Family, Netball Mums, Site Crew) and switch between them.",
  },
  {
    id: "leaving_circle",
    triggers: ["leave a circle", "leaving a group", "remove myself from circle"],
    keywords: ["leave", "leaving", "exit"],
    answer:
      "Open the circle, scroll to the Leaving section at the bottom, and confirm. Leaving stops SOS both ways and deletes your snapshots for that circle. You keep your account, your alerts, and your other circles. Leaving is the way to stop a circle's SOS, there is no mute.",
  },
  {
    id: "pricing",
    triggers: ["how much does it cost", "price", "subscription", "alrt plus", "how much is it"],
    keywords: ["cost", "price", "pay", "subscription", "plus"],
    answer:
      "ALRT+ is 7.99 per month or 79.99 per year, with a 1 month free trial for everyone. Core safety alerts are never behind the paywall. If you host a circle you pay, anyone you invite joins for free.",
  },
  {
    id: "seats",
    triggers: ["how do seats work", "seat cost", "how many people can i add"],
    keywords: ["seats", "seat", "hosting"],
    answer:
      "ALRT+ gives you 8 seats across up to 4 circles you host. A seat is used per person per circle you host, including your own. Joining someone else's circle is always free and never uses your seats.",
  },
  {
    id: "phone_numbers",
    triggers: ["do you collect phone numbers", "phone number", "share my number"],
    keywords: ["phone", "number", "contacts"],
    answer:
      "No. ALRT never collects, stores, or shares phone numbers. Your circle reaches you in app, and the only number the app ever dials is your local emergency number.",
  },
  {
    id: "delete_account",
    triggers: ["delete my account", "close my account", "remove my account"],
    keywords: ["delete", "account", "close"],
    answer:
      "Open Profile, then the Delete Account option, and type DELETE to confirm. This removes your account and data. If you host a family circle, deleting also dissolves it, so consider transferring it first.",
  },
  {
    id: "easy_mode",
    triggers: ["easy mode", "simple mode", "large text mode"],
    keywords: ["easy", "simple", "accessibility"],
    answer:
      "Easy Mode is a simpler layout with large text and a big status button, focused on Map, Alerts, and Family. You can turn it on in your profile settings.",
  },
  {
    id: "voice",
    triggers: ["voice search", "talk to the app", "use my voice", "speak instead of type"],
    keywords: ["voice", "microphone", "speak", "talk"],
    answer:
      "Tap the microphone to talk instead of typing. It is tap to talk only, runs on your device, and the audio is never stored. If you decline the microphone permission the mic is hidden and typing still works.",
  },
  {
    id: "alerts_push",
    triggers: ["why did i get an alert", "when do i get notified", "which alerts push"],
    keywords: ["notification", "push", "notified", "alerts"],
    answer:
      "You are notified for serious official warnings near you (Watch and Act or Emergency level). Community reports and lower level advice show in your list and on the map but do not buzz your phone.",
  },
  {
    id: "alert_shapes",
    triggers: [
      "what do the shapes mean",
      "what does the triangle mean",
      "what does the diamond mean",
      "what does the circle mean",
      "what does the shield mean",
      "what are the symbols",
    ],
    keywords: ["shape", "shapes", "triangle", "diamond", "circle", "shield", "symbol", "icon"],
    answer:
      "The shape tells you who issued the alert. Triangle: an AWS warning from the Australian Warning System, the only source that states a level in words (Advice, Watch and Act, Emergency Warning). Diamond: an official source such as a state agency or service. Circle: a community report from a person nearby, unverified. Shield: from ALRT itself. The full key is on the map under the layers button.",
  },
  {
    id: "alert_colours",
    triggers: [
      "what do the colours mean",
      "what do the colors mean",
      "what does the red alert mean",
      "what does orange mean",
      "what does yellow mean",
      "severity levels",
    ],
    keywords: ["colour", "color", "red", "orange", "yellow", "grey", "band", "severity", "urgent", "critical"],
    answer:
      "Colour tells you how urgent an alert is. Grey is Info, awareness only. Yellow is Monitor, stay across it. Orange is Action, do something now. Red is Critical, the highest level, and only official critical alerts fill solid red. Community reports are the exception: their circle wears the category colour (for example blue for weather), not an urgency colour.",
  },
  {
    id: "alert_types",
    triggers: [
      "what types of alerts",
      "what kinds of alerts",
      "what alerts are there",
      "alert categories",
    ],
    keywords: ["types", "kinds", "categories", "weather", "health", "security", "traffic", "utilities"],
    answer:
      "Alerts come from three sources: AWS warnings (triangles), official agencies (diamonds), and community reports (circles). Every alert also belongs to a category: Weather, Health, Security, Traffic, Utilities, Community, or Other. You can filter which sources show on the map from the layers button, and pick which categories notify you in Notifications settings.",
  },
  {
    id: "aws_levels",
    triggers: [
      "what is aws",
      "what is watch and act",
      "what is an emergency warning",
      "what is an advice level",
      "australian warning system",
    ],
    keywords: ["aws", "advice", "watch", "act", "emergency", "warning", "level"],
    answer:
      "AWS is the Australian Warning System, the national three level warning scale. Advice means an incident is happening, stay informed. Watch and Act means conditions are changing, take action to protect yourself. Emergency Warning is the highest level, you may be in danger and need to act immediately. In ALRT, AWS alerts are triangles and are the only alerts that write their level in words.",
  },
  {
    id: "community_reports",
    triggers: [
      "can i trust community reports",
      "what is a community report",
      "who posts community alerts",
      "unverified alert",
    ],
    keywords: ["community", "report", "unverified", "trust", "confirm", "dispute"],
    answer:
      "A community report (a circle on the map) is posted by a person nearby through the app and is unverified. Others nearby can confirm or dispute it, which you can see on the report. Treat it as a heads-up, not an official warning, and check official alerts for the confirmed picture. You can post one yourself from the ALRT button in the footer.",
  },
  {
    id: "emergency_generic",
    triggers: ["what number do i call", "emergency services", "who do i call in an emergency"],
    keywords: ["emergency", "call", "help"],
    answer:
      "If you are in danger, call your local emergency services now. In Australia that is 000, in Europe 112, and in the US or Canada 911. ALRT is a helper, it does not contact emergency services for you.",
  },
];
