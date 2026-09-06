# TDG Send-a-Gift durable state (e6f4)

- task: TDG-SEND-A-GIFT-PRODUCTION-VERIFY-095
- branch: feat/send-a-gift-admin-observability
- production_purchasable: false
- production_ready_pre_activation: true
- live_charges: NONE
- migration: 20260906010000–30000 applied (re-verified)
- meta_capi: wired in christmas stripeFulfill (event_id send_a_gift_purchase_{orderId}); external delivery still unverified
- next: TDG-SEND-A-GIFT-FOUNDER-ACTIVATION-GATE-096
