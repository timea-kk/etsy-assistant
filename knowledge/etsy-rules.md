# Etsy rules

Checked: November 2026. Re-check each quarter.

## Listing limits
- Title: 140 characters max. Aim for under 15 words.
- Tags: 13 max, 20 characters each.
- Photos: 20 max, plus 2 videos (5 to 15 seconds).
- Digital files: 5 max, 20 MB each.
- Description: 10,000 characters max. Mobile cuts it off early.

## How search reads a listing
- Title, tags, categories, attributes, description, first photo, reviews, and conversion all feed search.
- Exact matches in the title carry strong weight.
- Categories act like tags. Choose the most specific subcategory.
- Attributes create filters. A listing only appears in a filtered search if it has that attribute.
- Add every attribute that applies. Skip ones that don't. Irrelevant attributes hurt the shopper's experience.
- Occasion attributes (such as Christmas) only go on items made for that occasion.
- Customer service and reviews affect ranking. Fast replies and a complete About section help.

## Title and tag rules
- Multi-word phrases beat single words.
- Use all 13 tags.
- Don't repeat a phrase across title, tags, and categories.
- Don't misspell on purpose. Don't mix languages.
- Plurals are handled automatically.
- Use terms shoppers actually type. Verify with the tag analysis tool or Etsy's autocomplete.

## Description rules
- Put the main keyword and the key detail in the first two sentences.
- Use keywords naturally. Don't copy the title.
- Keep required information (contents, file type, usage terms) in the description.

## Messaging and marketing policy
- Coupons are at the seller's discretion and aren't shown publicly.
- Targeted Offers go to buyers who favourited an item or abandoned a cart. Thank-You coupons go to buyers after purchase.
- Each buyer can receive one of each Targeted Offer type from a shop at a time.
- Coupons can be added to replies in Etsy Messages.
- Without buyer consent, you may not add an Etsy member to your email or mailing list, use their identity for marketing, or keep their payment information.
- Promotions must not mislead buyers about value or timing.
- Sending launch codes to all past buyers is a grey area. Don't treat it as allowed. Check the current policy or ask Etsy Help first.
- An off-Etsy list must be opt-in only: a signup on Timea's own site or a Gumroad page.

## Digital listing API (UNVERIFIED)
- Create draft listing: POST https://api.etsy.com/v3/application/shops/{shop_id}/listings
- Update: PUT on the listing ID.
- Scopes: listings_w (create and edit listings), listings_r (read inactive and expired listings), listings_d (delete), shops_r.
- Required fields per secondary docs: quantity, title, description, price, taxonomy ID. Also who_made and when_made in the SDK.
- Digital listing type field: NOT CONFIRMED. Secondary sources describe "physical" draft listings only.
- File and image upload endpoints: NOT CONFIRMED.
- Rate limit: one secondary source says 10,000 calls per day. NOT CONFIRMED.
- App approval for listings_w: NOT CONFIRMED.
- Automation terms: NOT CONFIRMED. Read Etsy's API terms before building.

Record the verified answers here once checked, with the date.

## Unverified items to clear
- Digital listing fields and file upload endpoints
- API rate limits
- Whether pipes ("|") in titles affect ranking
- App approval process for listings_w
