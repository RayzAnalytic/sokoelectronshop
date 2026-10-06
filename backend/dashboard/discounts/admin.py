# dashboard/discounts/admin.py

"""
The Django admin registration for `Discount` lives in
`catalog/admin.py`, next to the model definition.

Registering it here too would raise
`AlreadyRegistered: The model Discount is already registered with
'catalog.DiscountAdmin'.`

This file is intentionally empty so Django's admin autodiscovery has
nothing to import. The React dashboard API in this app
(`/api/v1/admin/discounts/`) does not use the Django admin.
"""