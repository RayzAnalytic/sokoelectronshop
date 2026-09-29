from django.db import transaction
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..models import Address
from ..serializers import AddressSerializer


class AddressListCreateView(APIView):
    def get(self, request):
        qs = Address.objects.filter(user=request.user)
        return Response(AddressSerializer(qs, many=True).data)

    @transaction.atomic
    def post(self, request):
        ser = AddressSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        # First address a user ever creates is automatically the default.
        is_first = not Address.objects.filter(user=request.user).exists()
        make_default = bool(ser.validated_data.get("is_default", False)) or is_first

        if make_default:
            Address.objects.filter(user=request.user).update(is_default=False)

        addr = Address.objects.create(
            user=request.user,
            **{**ser.validated_data, "is_default": make_default},
        )
        return Response(
            AddressSerializer(addr).data,
            status=status.HTTP_201_CREATED,
        )


class AddressDetailView(APIView):
    def get(self, request, pk):
        addr = get_object_or_404(Address, pk=pk, user=request.user)
        return Response(AddressSerializer(addr).data)

    @transaction.atomic
    def patch(self, request, pk):
        addr = get_object_or_404(Address, pk=pk, user=request.user)
        ser = AddressSerializer(addr, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)

        # If the update makes this the default, unset the others first.
        if ser.validated_data.get("is_default") is True:
            Address.objects.filter(user=request.user).exclude(pk=pk).update(
                is_default=False,
            )

        ser.save()
        return Response(AddressSerializer(addr).data)

    def delete(self, request, pk):
        addr = get_object_or_404(Address, pk=pk, user=request.user)
        was_default = addr.is_default
        addr.delete()

        # If we just deleted the default, promote another address.
        if was_default:
            replacement = Address.objects.filter(user=request.user).first()
            if replacement:
                replacement.is_default = True
                replacement.save(update_fields=["is_default"])

        return Response(status=status.HTTP_204_NO_CONTENT)


class AddressSetDefaultView(APIView):
    @transaction.atomic
    def post(self, request, pk):
        addr = get_object_or_404(Address, pk=pk, user=request.user)
        Address.objects.filter(user=request.user).update(is_default=False)
        addr.is_default = True
        addr.save(update_fields=["is_default"])
        return Response(AddressSerializer(addr).data)